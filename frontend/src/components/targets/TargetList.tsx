/**
 * TargetList Component
 *
 * Premium data table for displacement targets using TanStack Table.
 * Features sorting, filtering, virtualization hints, and glassmorphism design.
 */

import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  Paper,
  TextInput,
  Button,
  Group,
  Text,
  Badge,
  ActionIcon,
  Tooltip,
  Menu,
  Checkbox,
  Pagination,
  SegmentedControl,
  Avatar,
  Anchor,
} from '@mantine/core';
import {
  IconSearch,
  IconFilter,
  IconSortAscending,
  IconSortDescending,
  IconEye,
  IconRefresh,
  IconExternalLink,
  IconDownload,
  IconColumns,
  IconDotsVertical,
  IconArrowUp,
  IconArrowDown,
  IconSelector,
} from '@tabler/icons-react';
import type { Company, FilterState } from '@/types';
import { StatusBadge, getStatusFromScore } from '@/components/common/StatusBadge';
import { ScoreGauge } from '@/components/common/ScoreGauge';
import { TableRowSkeleton } from '@/components/common/LoadingSpinner';

interface TargetListProps {
  companies: Company[];
  isLoading?: boolean;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
  onPageChange?: (page: number) => void;
  onFiltersChange?: (filters: FilterState) => void;
  onEnrichCompany?: (domain: string) => void;
}

export function TargetList({
  companies,
  isLoading = false,
  pagination,
  onPageChange,
  onFiltersChange,
  onEnrichCompany,
}: TargetListProps) {
  const navigate = useNavigate();

  // Table state
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'icp_score', desc: true },
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Define columns
  const columns = useMemo<ColumnDef<Company>[]>(
    () => [
      {
        accessorKey: 'company_name',
        header: ({ column }) => (
          <SortHeader column={column} label="Company" />
        ),
        cell: ({ row }) => {
          const company = row.original;
          return (
            <div className="flex items-center gap-3">
              <Avatar
                size="sm"
                radius="md"
                color="blue"
                className="flex-shrink-0"
              >
                {(company.company_name || company.domain).charAt(0).toUpperCase()}
              </Avatar>
              <div className="min-w-0">
                <Text size="sm" fw={500} c="white" truncate>
                  {company.company_name || company.domain}
                </Text>
                <Group gap={4} wrap="nowrap">
                  <Text size="xs" c="dimmed" truncate>
                    {company.domain}
                  </Text>
                  {company.ticker && (
                    <Badge size="xs" variant="outline" color="gray">
                      {company.exchange}:{company.ticker}
                    </Badge>
                  )}
                </Group>
              </div>
            </div>
          );
        },
        size: 250,
      },
      {
        accessorKey: 'icp_score',
        header: ({ column }) => (
          <SortHeader column={column} label="ICP Score" />
        ),
        cell: ({ getValue }) => {
          const score = getValue<number>() || 0;
          return (
            <div className="flex items-center justify-center">
              <ScoreGauge value={score} size="sm" />
            </div>
          );
        },
        size: 100,
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<Company['status']>();
          return <StatusBadge status={status} size="sm" />;
        },
        size: 100,
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue || filterValue === 'all') return true;
          return row.original.status === filterValue;
        },
      },
      {
        accessorKey: 'vertical',
        header: ({ column }) => (
          <SortHeader column={column} label="Vertical" />
        ),
        cell: ({ getValue }) => (
          <Text size="sm" c="white/70">
            {getValue<string>() || '---'}
          </Text>
        ),
        size: 120,
      },
      {
        accessorKey: 'partner_tech',
        header: 'Partner Tech',
        cell: ({ getValue }) => {
          const techs = getValue<string[]>() || [];
          if (techs.length === 0) {
            return <Text size="xs" c="dimmed">---</Text>;
          }
          return (
            <Group gap={4}>
              {techs.slice(0, 2).map((tech) => (
                <Badge key={tech} size="xs" variant="light" color="green">
                  {tech}
                </Badge>
              ))}
              {techs.length > 2 && (
                <Badge size="xs" variant="light" color="gray">
                  +{techs.length - 2}
                </Badge>
              )}
            </Group>
          );
        },
        size: 150,
      },
      {
        accessorKey: 'signal_score',
        header: ({ column }) => (
          <SortHeader column={column} label="Signals" />
        ),
        cell: ({ getValue }) => {
          const score = getValue<number>();
          if (!score) return <Text size="xs" c="dimmed">---</Text>;
          return (
            <Text
              size="sm"
              fw={500}
              c={score >= 50 ? 'green.4' : 'white/60'}
            >
              {score}
            </Text>
          );
        },
        size: 80,
      },
      {
        accessorKey: 'last_enriched',
        header: 'Last Enriched',
        cell: ({ getValue }) => {
          const date = getValue<string>();
          if (!date) {
            return (
              <Badge size="xs" variant="light" color="yellow">
                Not enriched
              </Badge>
            );
          }
          const d = new Date(date);
          const daysSince = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
          return (
            <Tooltip label={d.toLocaleString()}>
              <Text size="xs" c={daysSince > 7 ? 'yellow.4' : 'dimmed'}>
                {daysSince === 0 ? 'Today' : daysSince === 1 ? 'Yesterday' : `${daysSince}d ago`}
              </Text>
            </Tooltip>
          );
        },
        size: 100,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const company = row.original;
          return (
            <Group gap="xs" justify="flex-end" wrap="nowrap">
              <Tooltip label="View Details">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/company/${company.domain}`);
                  }}
                >
                  <IconEye size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Refresh Data">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEnrichCompany?.(company.domain);
                  }}
                >
                  <IconRefresh size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Visit Website">
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  component="a"
                  href={`https://${company.domain}`}
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconExternalLink size={14} />
                </ActionIcon>
              </Tooltip>
            </Group>
          );
        },
        size: 100,
      },
    ],
    [navigate, onEnrichCompany]
  );

  // Apply status filter
  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return companies;
    return companies.filter((c) => c.status === statusFilter);
  }, [companies, statusFilter]);

  // Create table instance
  const table = useReactTable({
    data: filteredData,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: !!pagination,
    pageCount: pagination?.total_pages || -1,
  });

  const handleRowClick = useCallback((domain: string) => {
    navigate(`/company/${domain}`);
  }, [navigate]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Paper
        radius="lg"
        className="bg-white/5 border border-white/10 overflow-hidden"
      >
        {/* Toolbar */}
        <div className="p-4 border-b border-white/10">
          <Group justify="space-between" wrap="wrap" gap="md">
            {/* Search */}
            <TextInput
              placeholder="Search companies..."
              leftSection={<IconSearch size={16} />}
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="flex-1 min-w-[200px] max-w-[400px]"
              classNames={{
                input: 'bg-white/5 border-white/10 text-white placeholder:text-white/40',
              }}
            />

            {/* Status filter */}
            <SegmentedControl
              value={statusFilter}
              onChange={setStatusFilter}
              size="xs"
              data={[
                { label: 'All', value: 'all' },
                { label: 'Hot', value: 'hot' },
                { label: 'Warm', value: 'warm' },
                { label: 'Cool', value: 'cool' },
                { label: 'Cold', value: 'cold' },
              ]}
              classNames={{
                root: 'bg-white/5',
              }}
            />

            {/* Actions */}
            <Group gap="xs">
              {/* Column visibility */}
              <Menu shadow="md" width={200}>
                <Menu.Target>
                  <Tooltip label="Toggle columns">
                    <ActionIcon variant="subtle">
                      <IconColumns size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Label>Visible Columns</Menu.Label>
                  {table.getAllLeafColumns().map((column) => {
                    if (column.id === 'actions') return null;
                    return (
                      <Menu.Item
                        key={column.id}
                        onClick={() => column.toggleVisibility()}
                      >
                        <Checkbox
                          label={column.id}
                          checked={column.getIsVisible()}
                          onChange={() => {}}
                          size="xs"
                        />
                      </Menu.Item>
                    );
                  })}
                </Menu.Dropdown>
              </Menu>

              {/* Export */}
              <Tooltip label="Export CSV">
                <ActionIcon variant="subtle">
                  <IconDownload size={18} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Group>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Header */}
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-white/10 bg-white/5"
                >
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs font-semibold text-white/60 uppercase tracking-wider"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            {/* Body */}
            <tbody>
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={columns.length} className="p-0">
                      <TableRowSkeleton columns={columns.length} />
                    </td>
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center">
                    <Text c="dimmed">No companies found</Text>
                  </td>
                </tr>
              ) : (
                // Data rows
                <AnimatePresence>
                  {table.getRowModel().rows.map((row, index) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => handleRowClick(row.original.domain)}
                      className="
                        border-b border-white/5 cursor-pointer
                        hover:bg-white/5 transition-colors
                      "
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td
                          key={cell.id}
                          className="px-4 py-3"
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.total_pages > 1 && (
          <div className="p-4 border-t border-white/10">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} results
              </Text>
              <Pagination
                value={pagination.page}
                onChange={onPageChange || (() => {})}
                total={pagination.total_pages}
                size="sm"
                withEdges
                classNames={{
                  control: 'border-white/10 text-white/70 hover:bg-white/10',
                }}
              />
            </Group>
          </div>
        )}
      </Paper>
    </motion.div>
  );
}

// Sort header component
interface SortHeaderProps {
  column: any;
  label: string;
}

function SortHeader({ column, label }: SortHeaderProps) {
  return (
    <button
      onClick={() => column.toggleSorting()}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      <span>{label}</span>
      {{
        asc: <IconArrowUp size={12} />,
        desc: <IconArrowDown size={12} />,
      }[column.getIsSorted() as string] ?? <IconSelector size={12} className="opacity-30" />}
    </button>
  );
}
