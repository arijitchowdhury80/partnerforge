/**
 * Strategic Insights Component
 *
 * Displays synthesized strategic analysis from all enrichment modules.
 * Shows Algolia value prop mapping, sales pitch, business impact, and timing intelligence.
 *
 * Data Flow:
 * - Fetches from /api/audits/:auditId/strategic-analysis
 * - Displays company-level strategic analysis (Level 2)
 * - Links back to module-level insights (Level 1) for deep-dive
 */

import React from 'react';
import useSWR from 'swr';
import { Card, Badge, Text, Title, Progress, Timeline, Group, Stack, Alert } from '@mantine/core';
import { IconAlertCircle, IconTrendingUp, IconCalendar, IconTarget, IconShieldCheck } from '@tabler/icons-react';

// ============================================================================
// Type Definitions
// ============================================================================

type AlgoliaValueProp =
  | 'search_relevance'
  | 'scale_performance'
  | 'mobile_experience'
  | 'conversion_optimization'
  | 'personalization'
  | 'time_to_market'
  | 'operational_efficiency';

interface StrategicAnalysis {
  company_id: string;
  audit_id: string;
  primary_value_prop: AlgoliaValueProp;
  secondary_value_props: AlgoliaValueProp[];
  sales_pitch: string;
  business_impact: string;
  strategic_recommendations: string;
  trigger_events: string[];
  timing_signals: string[];
  caution_signals: string[];
  overall_confidence_score: number;
  insights_synthesized_from: string[];
  analysis_generated_at: string;
}

interface StrategicInsightsProps {
  auditId: string;
}

// ============================================================================
// Main Component
// ============================================================================

export const StrategicInsights: React.FC<StrategicInsightsProps> = ({ auditId }) => {
  const { data, error, isLoading } = useSWR<StrategicAnalysis>(
    `/api/audits/${auditId}/strategic-analysis`,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false
    }
  );

  if (isLoading) {
    return (
      <Card shadow="sm" padding="lg" radius="md">
        <Text c="dimmed">Loading strategic insights...</Text>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Failed to load strategic analysis. {error.message}
      </Alert>
    );
  }

  if (!data) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="No Data" color="yellow">
        Strategic analysis not yet available. Complete enrichment to generate insights.
      </Alert>
    );
  }

  return (
    <Stack gap="lg">
      {/* Header with Confidence Score */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group justify="space-between" mb="md">
          <Title order={3}>Strategic Intelligence</Title>
          <ConfidenceGauge score={data.overall_confidence_score} />
        </Group>

        <Text size="sm" c="dimmed">
          Synthesized from {data.insights_synthesized_from.length} enrichment modules •
          Generated {new Date(data.analysis_generated_at).toLocaleDateString()}
        </Text>
      </Card>

      {/* Value Proposition Badges */}
      <Card shadow="sm" padding="lg" radius="md">
        <Title order={4} mb="md">
          Algolia Value Propositions
        </Title>

        <Group gap="md">
          {/* Primary Value Prop - Large */}
          <ValuePropBadge
            valueProp={data.primary_value_prop}
            primary
          />

          {/* Secondary Value Props - Small */}
          {data.secondary_value_props.map(prop => (
            <ValuePropBadge
              key={prop}
              valueProp={prop}
              primary={false}
            />
          ))}
        </Group>
      </Card>

      {/* Sales Pitch */}
      <Card shadow="sm" padding="lg" radius="md">
        <Group mb="md">
          <IconTarget size={20} />
          <Title order={4}>Sales Pitch</Title>
        </Group>

        <Stack gap="sm">
          {data.sales_pitch.split('\n\n').map((paragraph, i) => (
            <Text key={i} size="sm">
              {paragraph}
            </Text>
          ))}
        </Stack>

        {/* Business Impact - Highlighted */}
        {data.business_impact && (
          <Alert
            icon={<IconTrendingUp size={16} />}
            title="Business Impact"
            color="blue"
            mt="md"
          >
            {data.business_impact}
          </Alert>
        )}
      </Card>

      {/* Strategic Recommendations */}
      <Card shadow="sm" padding="lg" radius="md">
        <Title order={4} mb="md">
          How Algolia Can Help
        </Title>

        <div
          dangerouslySetInnerHTML={{
            __html: parseMarkdownToHTML(data.strategic_recommendations)
          }}
          style={{ fontSize: '14px', lineHeight: '1.6' }}
        />
      </Card>

      {/* Timing Intelligence */}
      <TimingIntelligence
        triggerEvents={data.trigger_events}
        timingSignals={data.timing_signals}
        cautionSignals={data.caution_signals}
      />

      {/* Data Sources */}
      <Card shadow="sm" padding="lg" radius="md">
        <Title order={5} mb="sm">
          Data Sources
        </Title>
        <Group gap="xs">
          {data.insights_synthesized_from.map(module => (
            <Badge key={module} size="sm" variant="light">
              {formatModuleName(module)}
            </Badge>
          ))}
        </Group>
      </Card>
    </Stack>
  );
};

// ============================================================================
// Sub-Components
// ============================================================================

interface ConfidenceGaugeProps {
  score: number;
}

const ConfidenceGauge: React.FC<ConfidenceGaugeProps> = ({ score }) => {
  const percentage = ((score - 8.0) / 2.0) * 100; // 8.0-10.0 → 0-100%
  const color = score >= 9.5 ? 'green' : score >= 9.0 ? 'blue' : 'yellow';

  return (
    <Stack gap={4} style={{ minWidth: 120 }}>
      <Group justify="space-between">
        <Text size="xs" fw={500}>
          Confidence
        </Text>
        <Text size="xs" fw={700}>
          {score.toFixed(1)}/10
        </Text>
      </Group>
      <Progress value={percentage} color={color} size="sm" />
    </Stack>
  );
};

interface ValuePropBadgeProps {
  valueProp: AlgoliaValueProp;
  primary: boolean;
}

const ValuePropBadge: React.FC<ValuePropBadgeProps> = ({ valueProp, primary }) => {
  const labels: Record<AlgoliaValueProp, string> = {
    search_relevance: 'Search Relevance',
    scale_performance: 'Scale & Performance',
    mobile_experience: 'Mobile Experience',
    conversion_optimization: 'Conversion Optimization',
    personalization: 'Personalization',
    time_to_market: 'Time to Market',
    operational_efficiency: 'Operational Efficiency'
  };

  const colors: Record<AlgoliaValueProp, string> = {
    search_relevance: 'blue',
    scale_performance: 'green',
    mobile_experience: 'purple',
    conversion_optimization: 'orange',
    personalization: 'pink',
    time_to_market: 'teal',
    operational_efficiency: 'cyan'
  };

  return (
    <Badge
      size={primary ? 'xl' : 'lg'}
      color={colors[valueProp]}
      variant={primary ? 'filled' : 'light'}
      leftSection={primary ? <IconTarget size={16} /> : undefined}
    >
      {labels[valueProp]}
    </Badge>
  );
};

interface TimingIntelligenceProps {
  triggerEvents: string[];
  timingSignals: string[];
  cautionSignals: string[];
}

const TimingIntelligence: React.FC<TimingIntelligenceProps> = ({
  triggerEvents,
  timingSignals,
  cautionSignals
}) => {
  if (triggerEvents.length === 0 && timingSignals.length === 0 && cautionSignals.length === 0) {
    return null;
  }

  return (
    <Card shadow="sm" padding="lg" radius="md">
      <Group mb="md">
        <IconCalendar size={20} />
        <Title order={4}>Timing Intelligence</Title>
      </Group>

      <Stack gap="lg">
        {/* Trigger Events - Timeline */}
        {triggerEvents.length > 0 && (
          <div>
            <Text size="sm" fw={600} mb="xs">
              Trigger Events
            </Text>
            <Timeline active={-1} bulletSize={20} lineWidth={2}>
              {triggerEvents.map((event, i) => (
                <Timeline.Item key={i} bullet={<IconCalendar size={12} />} title={event}>
                  <Text size="xs" c="dimmed" mt={4}>
                    Notable event for sales timing
                  </Text>
                </Timeline.Item>
              ))}
            </Timeline>
          </div>
        )}

        {/* Why Now Signals - Green badges */}
        {timingSignals.length > 0 && (
          <div>
            <Text size="sm" fw={600} mb="xs">
              Why Now Signals
            </Text>
            <Stack gap="xs">
              {timingSignals.map((signal, i) => (
                <Alert
                  key={i}
                  icon={<IconTrendingUp size={14} />}
                  color="green"
                  variant="light"
                >
                  {signal}
                </Alert>
              ))}
            </Stack>
          </div>
        )}

        {/* Caution Signals - Yellow/Red badges */}
        {cautionSignals.length > 0 && (
          <div>
            <Text size="sm" fw={600} mb="xs">
              Caution Signals
            </Text>
            <Stack gap="xs">
              {cautionSignals.map((signal, i) => (
                <Alert
                  key={i}
                  icon={<IconShieldCheck size={14} />}
                  color="yellow"
                  variant="light"
                >
                  {signal}
                </Alert>
              ))}
            </Stack>
          </div>
        )}
      </Stack>
    </Card>
  );
};

// ============================================================================
// Helper Functions
// ============================================================================

function formatModuleName(module: string): string {
  return module
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function parseMarkdownToHTML(markdown: string): string {
  // Simple markdown parser for strategic recommendations
  let html = markdown;

  // Headers
  html = html.replace(/^## (.+)$/gm, '<h4 style="margin-top: 16px; margin-bottom: 8px;">$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h5 style="margin-top: 12px; margin-bottom: 6px;">$1</h5>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Paragraphs
  html = html
    .split('\n\n')
    .map(p => (p.trim() ? `<p style="margin-bottom: 12px;">${p}</p>` : ''))
    .join('');

  // Line breaks
  html = html.replace(/\n/g, '<br />');

  return html;
}

export default StrategicInsights;
