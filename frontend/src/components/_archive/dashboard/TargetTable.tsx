import { DataTable, type DataTableColumn, type DataTableSortStatus } from 'mantine-datatable';
import { Badge, Group, Text, ActionIcon, Tooltip, Progress } from '@mantine/core';
import { IconEye, IconRefresh, IconExternalLink, IconFlame, IconTrendingUp, IconSnowflake } from '@tabler/icons-react';
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

// Status badge config - BOLD, VISIBLE
const statusConfig: Record<string, { bg: string; icon: typeof IconFlame; label: string }> = {
  hot: { bg: '#dc2626', icon: IconFlame, label: 'HOT' },
  warm: { bg: '#ea580c', icon: IconTrendingUp, label: 'WARM' },
  cold: { bg: '#64748b', icon: IconSnowflake, label: 'COLD' },
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
        <Group gap="sm">
          <Text fw={600} size="md">{company.company_name || company.domain}</Text>
          {company.ticker && (
            <Badge size="sm" variant="outline" style={{ fontWeight: 600 }}>
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
      width: 130,
      render: (company) => {
        const color = company.icp_score >= 80 ? '#dc2626' : company.icp_score >= 40 ? '#ea580c' : '#64748b';
        return (
          <Group gap="sm">
            <Progress value={company.icp_score} size="md" w={50} color={company.icp_score >= 80 ? 'red' : company.icp_score >= 40 ? 'orange' : 'gray'} />
            <Text size="md" fw={700} style={{ color, minWidth: 28 }}>
              {company.icp_score}
            </Text>
          </Group>
        );
      },
    },
    {
      accessor: 'status',
      title: 'Status',
      sortable: true,
      width: 120,
      render: (company) => {
        const config = statusConfig[company.status] || statusConfig.cold;
        const Icon = config.icon;
        return (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 6,
              background: config.bg,
              color: 'white',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.5px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            }}
          >
            <Icon size={16} stroke={2.5} />
            {config.label}
          </div>
        );
      },
    },
    {
      accessor: 'vertical',
      title: 'Vertical',
      sortable: true,
      width: 160,
      render: (company) => (
        <Text size="md" c="#334155">
          {company.vertical || '—'}
        </Text>
      ),
    },
    {
      accessor: 'partner_tech',
      title: 'Partner Tech',
      width: 180,
      render: (company) => (
        <Group gap={6}>
          {company.partner_tech?.slice(0, 2).map((tech) => (
            <Badge key={tech} size="md" variant="filled" color="green" style={{ fontWeight: 600 }}>
              {tech}
            </Badge>
          ))}
          {(company.partner_tech?.length || 0) > 2 && (
            <Badge size="md" variant="filled" color="gray" style={{ fontWeight: 600 }}>
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
        <Text size="md" fw={600} c={company.signal_score > 50 ? 'green' : '#64748b'}>
          {company.signal_score || '—'}
        </Text>
      ),
    },
    {
      accessor: 'last_enriched',
      title: 'Last Enriched',
      width: 140,
      render: (company) => (
        <Text size="sm" c="#64748b">
          {company.last_enriched
            ? new Date(company.last_enriched).toLocaleDateString()
            : 'Never'}
        </Text>
      ),
    },
    {
      accessor: 'actions',
      title: '',
      width: 120,
      render: (company) => (
        <Group gap="sm" justify="flex-end">
          <Tooltip label="View Details">
            <ActionIcon
              variant="subtle"
              size="lg"
              onClick={() => navigate(`/company/${company.domain}`)}
            >
              <IconEye size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Refresh Data">
            <ActionIcon variant="subtle" size="lg">
              <IconRefresh size={20} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Open Website">
            <ActionIcon
              variant="subtle"
              size="lg"
              component="a"
              href={`https://${company.domain}`}
              target="_blank"
            >
              <IconExternalLink size={20} />
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
        <Text c="dimmed" ta="center" py="xl" size="lg">
          No companies found
        </Text>
      }
      onRowClick={({ record }) => navigate(`/company/${record.domain}`)}
      rowStyle={() => ({ cursor: 'pointer' })}
    />
  );
}
