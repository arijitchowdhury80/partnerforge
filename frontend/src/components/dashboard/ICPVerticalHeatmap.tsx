/**
 * ICP vs Vertical Heatmap
 *
 * 2D visualization showing distribution of targets across:
 * - X-axis: Verticals (Commerce, Media, Financial, Healthcare, Other)
 * - Y-axis: ICP Tiers (T1 80+, T2 60-79, T3 40-59, T4 0-39)
 */

import { ResponsiveHeatMap } from '@nivo/heatmap';
import { Paper, Text, Group, Badge, Tooltip, Box } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';

// ICP Tier definitions
const ICP_TIERS = [
  { id: 'T1 (80+)', label: 'Hot', color: '#ef4444', min: 80, max: 100 },
  { id: 'T2 (60-79)', label: 'Warm', color: '#f97316', min: 60, max: 79 },
  { id: 'T3 (40-59)', label: 'Cool', color: '#5468ff', min: 40, max: 59 },
  { id: 'T4 (0-39)', label: 'Cold', color: '#6b7280', min: 0, max: 39 },
];

// Vertical categories
const VERTICALS = ['Commerce', 'Media', 'Financial', 'Healthcare', 'Other'];

interface ICPVerticalHeatmapProps {
  data?: {
    vertical: string;
    tier: string;
    count: number;
  }[];
  loading?: boolean;
}

// Transform raw data to Nivo heatmap format
function transformData(rawData?: ICPVerticalHeatmapProps['data']) {
  // Default data if none provided (mock)
  const defaultData = [
    { vertical: 'Commerce', 'T1 (80+)': 5, 'T2 (60-79)': 28, 'T3 (40-59)': 156, 'T4 (0-39)': 890 },
    { vertical: 'Media', 'T1 (80+)': 2, 'T2 (60-79)': 12, 'T3 (40-59)': 85, 'T4 (0-39)': 420 },
    { vertical: 'Financial', 'T1 (80+)': 1, 'T2 (60-79)': 6, 'T3 (40-59)': 48, 'T4 (0-39)': 380 },
    { vertical: 'Healthcare', 'T1 (80+)': 1, 'T2 (60-79)': 2, 'T3 (40-59)': 65, 'T4 (0-39)': 295 },
    { vertical: 'Other', 'T1 (80+)': 0, 'T2 (60-79)': 1, 'T3 (40-59)': 40, 'T4 (0-39)': 300 },
  ];

  if (!rawData || rawData.length === 0) {
    // Convert default data to Nivo format
    return ICP_TIERS.map((tier) => ({
      id: tier.id,
      data: defaultData.map((d) => ({
        x: d.vertical,
        y: d[tier.id as keyof typeof d] as number,
      })),
    }));
  }

  // Transform provided data
  return ICP_TIERS.map((tier) => ({
    id: tier.id,
    data: VERTICALS.map((vertical) => {
      const match = rawData.find((d) => d.vertical === vertical && d.tier === tier.id);
      return {
        x: vertical,
        y: match?.count || 0,
      };
    }),
  }));
}

export function ICPVerticalHeatmap({ data, loading }: ICPVerticalHeatmapProps) {
  const heatmapData = transformData(data);

  // Calculate max value for color scale
  const maxValue = Math.max(
    ...heatmapData.flatMap((tier) => tier.data.map((d) => d.y))
  );

  return (
    <Paper p="md" withBorder>
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <Text fw={500}>ICP vs Vertical Distribution</Text>
          <Tooltip
            label="Shows count of targets across ICP score tiers and industry verticals. Darker = more targets."
            position="right"
            withArrow
            multiline
            w={250}
          >
            <IconInfoCircle size={16} style={{ cursor: 'help', color: 'var(--mantine-color-dimmed)' }} />
          </Tooltip>
        </Group>
        <Group gap="xs">
          {ICP_TIERS.slice(0, 2).map((tier) => (
            <Badge
              key={tier.id}
              size="xs"
              variant="light"
              color={tier.id.includes('80') ? 'red' : 'orange'}
            >
              {tier.label}
            </Badge>
          ))}
        </Group>
      </Group>

      <Box h={280}>
        <ResponsiveHeatMap
          data={heatmapData}
          margin={{ top: 20, right: 90, bottom: 60, left: 90 }}
          valueFormat=">-.0f"
          axisTop={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45,
            legend: '',
            legendOffset: 46,
          }}
          axisRight={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'ICP Tier',
            legendPosition: 'middle',
            legendOffset: 70,
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'ICP Tier',
            legendPosition: 'middle',
            legendOffset: -72,
          }}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45,
            legend: 'Vertical',
            legendPosition: 'middle',
            legendOffset: 50,
          }}
          colors={{
            type: 'sequential',
            scheme: 'blues',
            minValue: 0,
            maxValue: maxValue,
          }}
          emptyColor="#1a1b1e"
          borderRadius={4}
          borderWidth={2}
          borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
          labelTextColor={{ from: 'color', modifiers: [['brighter', 3]] }}
          legends={[
            {
              anchor: 'bottom',
              translateX: 0,
              translateY: 30,
              length: 200,
              thickness: 8,
              direction: 'row',
              tickPosition: 'after',
              tickSize: 3,
              tickSpacing: 4,
              tickOverlap: false,
              tickFormat: '>-.0f',
              title: 'Count',
              titleAlign: 'start',
              titleOffset: 4,
            },
          ]}
          annotations={[]}
          hoverTarget="cell"
          tooltip={({ cell }) => (
            <Paper p="xs" shadow="md" withBorder style={{ background: 'var(--mantine-color-dark-7)' }}>
              <Text size="sm" fw={500}>{cell.serieId}</Text>
              <Text size="xs" c="dimmed">{cell.data.x}</Text>
              <Text size="sm" fw={700} c="blue">{cell.formattedValue} targets</Text>
            </Paper>
          )}
          theme={{
            text: {
              fill: '#c1c2c5',
              fontSize: 11,
            },
            axis: {
              ticks: {
                text: {
                  fill: '#c1c2c5',
                },
              },
              legend: {
                text: {
                  fill: '#909296',
                  fontSize: 12,
                },
              },
            },
            legends: {
              text: {
                fill: '#c1c2c5',
              },
              title: {
                text: {
                  fill: '#909296',
                },
              },
            },
          }}
        />
      </Box>

      {/* Legend for tiers */}
      <Group justify="center" mt="md" gap="lg">
        {ICP_TIERS.map((tier) => (
          <Tooltip key={tier.id} label={`Score ${tier.min}-${tier.max}`} withArrow>
            <Group gap={4} style={{ cursor: 'help' }}>
              <Box
                w={12}
                h={12}
                style={{ backgroundColor: tier.color, borderRadius: 2 }}
              />
              <Text size="xs" c="dimmed">{tier.label}</Text>
            </Group>
          </Tooltip>
        ))}
      </Group>
    </Paper>
  );
}
