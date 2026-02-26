import { DataTable, type DataTableColumn, type DataTableSortStatus } from 'mantine-datatable';
import { Badge, Group, Text, ActionIcon, Tooltip, Progress } from '@mantine/core';
import { IconEye, IconRefresh, IconExternalLink } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

import type { Company } from '@/types';

interface TargetTableProps {
  companies: Company[];
  loading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

const statusColors: Record<string, string> = {
  hot: 'red',
  warm: 'orange',
  cool: 'blue',
  cold: 'gray',
};

const marginZoneColors: Record<string, string> = {
  green: 'green',
  yellow: 'yellow',
  red: 'red',
};

export function TargetTable({ companies, loading = false, pagination }: TargetTableProps) {
  const navigate = useNavigate();
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<Company>>({
    columnAccessor: 'icp_score',
    direction: 'desc',
  });

  const columns: DataTableColumn<Company>[] = [
    {
      accessor: 'company_name',
      title: 'Company',
      sortable: true,
      render: (company) => (
        <Group gap="xs">
          <Text fw={500}>{company.company_name || company.domain}</Text>
          {company.ticker && (
            <Badge size="xs" variant="outline">
              {company.exchange}:{company.ticker}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      accessor: 'icp_score',
      title: 'ICP Score',
      sortable: true,
      width: 120,
      render: (company) => (
        <Group gap="xs">
          <Progress value={company.icp_score} size="sm" w={60} color="blue" />
          <Text size="sm" fw={500}>
            {company.icp_score}
          </Text>
        </Group>
      ),
    },
    {
      accessor: 'status',
      title: 'Status',
      sortable: true,
      width: 100,
      render: (company) => (
        <Badge color={statusColors[company.status] || 'gray'} variant="light">
          {company.status?.toUpperCase()}
        </Badge>
      ),
    },
    {
      accessor: 'vertical',
      title: 'Vertical',
      sortable: true,
      width: 120,
    },
    {
      accessor: 'partner_tech',
      title: 'Partner Tech',
      render: (company) => (
        <Group gap={4}>
          {company.partner_tech?.slice(0, 2).map((tech) => (
            <Badge key={tech} size="xs" variant="light">
              {tech}
            </Badge>
          ))}
          {(company.partner_tech?.length || 0) > 2 && (
            <Badge size="xs" variant="light" color="gray">
              +{(company.partner_tech?.length || 0) - 2}
            </Badge>
          )}
        </Group>
      ),
    },
    {
      accessor: 'signal_score',
      title: 'Signals',
      sortable: true,
      width: 100,
      render: (company) => (
        <Text size="sm" c={company.signal_score > 50 ? 'green' : 'dimmed'}>
          {company.signal_score || '—'}
        </Text>
      ),
    },
    {
      accessor: 'last_enriched',
      title: 'Last Enriched',
      width: 130,
      render: (company) => (
        <Text size="xs" c="dimmed">
          {company.last_enriched
            ? new Date(company.last_enriched).toLocaleDateString()
            : 'Never'}
        </Text>
      ),
    },
    {
      accessor: 'actions',
      title: '',
      width: 100,
      render: (company) => (
        <Group gap="xs" justify="flex-end">
          <Tooltip label="View Details">
            <ActionIcon
              variant="subtle"
              onClick={() => navigate(`/company/${company.domain}`)}
            >
              <IconEye size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Refresh Data">
            <ActionIcon variant="subtle">
              <IconRefresh size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Open Website">
            <ActionIcon
              variant="subtle"
              component="a"
              href={`https://${company.domain}`}
              target="_blank"
            >
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      records={companies}
      sortStatus={sortStatus}
      onSortStatusChange={setSortStatus}
      fetching={loading}
      minHeight={400}
      withTableBorder
      borderRadius="md"
      striped
      highlightOnHover
      idAccessor="domain"
      emptyState={
        <Text c="dimmed" ta="center" py="xl">
          No companies found
        </Text>
      }
      onRowClick={({ record }) => navigate(`/company/${record.domain}`)}
      rowStyle={() => ({ cursor: 'pointer' })}
    />
  );
}
