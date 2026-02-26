import { Badge, Tooltip, Anchor, Group } from '@mantine/core';
import { IconExternalLink, IconClock } from '@tabler/icons-react';
import type { SourceCitation, FreshnessStatus } from '@/types';

interface SourceBadgeProps {
  source: SourceCitation;
  freshness?: FreshnessStatus;
  showDate?: boolean;
  compact?: boolean;
}

const freshnessColors: Record<FreshnessStatus, string> = {
  fresh: 'green',
  stale: 'yellow',
  expired: 'red',
};

const sourceTypeLabels: Record<string, string> = {
  api: 'API',
  webpage: 'Web',
  document: 'Doc',
  transcript: 'Transcript',
};

export function SourceBadge({ source, freshness = 'fresh', showDate = true, compact = false }: SourceBadgeProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (compact) {
    return (
      <Tooltip
        label={
          <div>
            <div>Source: {source.url}</div>
            <div>Date: {formatDate(source.date)}</div>
            <div>Type: {sourceTypeLabels[source.type] || source.type}</div>
          </div>
        }
        multiline
        w={300}
      >
        <Badge
          size="xs"
          variant="dot"
          color={freshnessColors[freshness]}
          style={{ cursor: 'pointer' }}
          component="a"
          href={source.url}
          target="_blank"
        >
          {sourceTypeLabels[source.type] || source.type}
        </Badge>
      </Tooltip>
    );
  }

  return (
    <Group gap="xs">
      <Tooltip label={`Freshness: ${freshness}`}>
        <Badge
          size="sm"
          variant="light"
          color={freshnessColors[freshness]}
          leftSection={<IconClock size={12} />}
        >
          {showDate && formatDate(source.date)}
        </Badge>
      </Tooltip>
      <Anchor
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        size="xs"
        c="dimmed"
      >
        <Group gap={4}>
          <span>{sourceTypeLabels[source.type] || source.type}</span>
          <IconExternalLink size={12} />
        </Group>
      </Anchor>
    </Group>
  );
}
