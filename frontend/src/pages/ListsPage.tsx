/**
 * ListsPage - List Management View
 *
 * Upload, manage, and track enrichment progress for company lists.
 */

import { useState } from 'react';
import {
  Container,
  Title,
  Tabs,
  Group,
  Text,
  Badge,
  Button,
  Paper,
  SegmentedControl,
  Select,
  Modal,
} from '@mantine/core';
import {
  IconUpload,
  IconList,
  IconProgress,
  IconPlus,
  IconFilter,
} from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

import { GalaxyBackground } from '@/components/common/GalaxyBackground';
import { ListUpload, ListTable, ListProgress, sampleWaveProgress } from '@/components/lists';
import { useLists, useDeleteList, useStartEnrichment, useExportList } from '@/hooks/useLists';
import type { UploadedListItem } from '@/components/lists/ListTable';

export function ListsPage() {
  const [activeTab, setActiveTab] = useState<string | null>('lists');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedList, setSelectedList] = useState<UploadedListItem | null>(null);
  const [uploadModalOpened, { open: openUploadModal, close: closeUploadModal }] = useDisclosure(false);

  // Query hooks
  const { data: listsData, isLoading: listsLoading } = useLists(
    statusFilter === 'all' ? undefined : { status: statusFilter as 'pending' | 'processing' | 'complete' | 'error' }
  );

  // Mutation hooks
  const deleteList = useDeleteList();
  const startEnrichment = useStartEnrichment();
  const exportList = useExportList();

  const lists = listsData?.data || [];
  const processingCount = lists.filter((l) => l.status === 'processing').length;
  const pendingCount = lists.filter((l) => l.status === 'pending').length;

  const handleView = (id: string) => {
    const list = lists.find((l) => l.id === id);
    if (list) {
      setSelectedList(list);
      setActiveTab('progress');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this list?')) {
      deleteList.mutate(id);
    }
  };

  const handleStartEnrichment = (id: string) => {
    startEnrichment.mutate(id);
  };

  const handleRetry = (id: string) => {
    startEnrichment.mutate(id);
  };

  const handleExport = (id: string) => {
    exportList.mutate(id);
  };

  return (
    <GalaxyBackground>
      <Container size="xl" py="md">
        {/* Header */}
        <Group justify="space-between" mb="lg">
          <div>
            <Title order={2} c="white">List Management</Title>
            <Text c="gray.4" size="sm">
              Upload and manage company lists for enrichment
            </Text>
          </div>
        <Button leftSection={<IconPlus size={16} />} onClick={openUploadModal}>
          Upload New List
        </Button>
      </Group>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab
            value="lists"
            leftSection={<IconList size={16} />}
            rightSection={
              <Badge variant="light" size="sm">
                {lists.length}
              </Badge>
            }
          >
            All Lists
          </Tabs.Tab>
          <Tabs.Tab
            value="progress"
            leftSection={<IconProgress size={16} />}
            rightSection={
              processingCount > 0 ? (
                <Badge variant="filled" color="blue" size="sm">
                  {processingCount}
                </Badge>
              ) : null
            }
          >
            Enrichment Progress
          </Tabs.Tab>
          <Tabs.Tab value="upload" leftSection={<IconUpload size={16} />}>
            Quick Upload
          </Tabs.Tab>
        </Tabs.List>

        {/* All Lists Tab */}
        <Tabs.Panel value="lists">
          {/* Filters */}
          <Paper p="md" mb="lg" withBorder>
            <Group>
              <Text size="sm" fw={500}>
                Filter by status:
              </Text>
              <SegmentedControl
                size="sm"
                data={[
                  { label: 'All', value: 'all' },
                  {
                    label: (
                      <Group gap="xs">
                        Pending
                        {pendingCount > 0 && (
                          <Badge size="xs" color="yellow">
                            {pendingCount}
                          </Badge>
                        )}
                      </Group>
                    ),
                    value: 'pending',
                  },
                  {
                    label: (
                      <Group gap="xs">
                        Processing
                        {processingCount > 0 && (
                          <Badge size="xs" color="blue">
                            {processingCount}
                          </Badge>
                        )}
                      </Group>
                    ),
                    value: 'processing',
                  },
                  { label: 'Complete', value: 'complete' },
                  { label: 'Failed', value: 'error' },
                ]}
                value={statusFilter}
                onChange={setStatusFilter}
              />
              <Select
                placeholder="Partner Tech"
                data={['Adobe AEM', 'Shopify', 'Salesforce', 'BigCommerce', 'Magento']}
                clearable
                size="sm"
                style={{ marginLeft: 'auto' }}
              />
            </Group>
          </Paper>

          {/* Lists Table */}
          <ListTable
            lists={lists}
            onView={handleView}
            onDelete={handleDelete}
            onRetry={handleRetry}
            onStartEnrichment={handleStartEnrichment}
            onExport={handleExport}
          />
        </Tabs.Panel>

        {/* Progress Tab */}
        <Tabs.Panel value="progress">
          {selectedList ? (
            <ListProgress
              listId={selectedList.id}
              listName={selectedList.name}
              totalCompanies={selectedList.rowCount}
              completedCompanies={selectedList.enrichedCount}
              failedCompanies={0}
              waves={sampleWaveProgress}
              estimatedTimeRemaining={1800}
              currentCompany="mercedes-benz.com"
            />
          ) : processingCount > 0 ? (
            // Show first processing list
            <>
              {lists
                .filter((l) => l.status === 'processing')
                .slice(0, 1)
                .map((list) => (
                  <ListProgress
                    key={list.id}
                    listId={list.id}
                    listName={list.name}
                    totalCompanies={list.rowCount}
                    completedCompanies={list.enrichedCount}
                    failedCompanies={0}
                    waves={sampleWaveProgress}
                    estimatedTimeRemaining={1800}
                    currentCompany="mercedes-benz.com"
                  />
                ))}
            </>
          ) : (
            <Paper p="xl" withBorder ta="center">
              <IconProgress size={48} color="var(--mantine-color-dimmed)" style={{ marginBottom: 16 }} />
              <Text size="lg" fw={500} c="dimmed">
                No enrichments in progress
              </Text>
              <Text size="sm" c="dimmed" mt="xs">
                Start enrichment on a list to track progress here
              </Text>
              <Button
                variant="light"
                mt="md"
                onClick={() => setActiveTab('lists')}
              >
                View Lists
              </Button>
            </Paper>
          )}
        </Tabs.Panel>

        {/* Quick Upload Tab */}
        <Tabs.Panel value="upload">
          <ListUpload />
        </Tabs.Panel>
      </Tabs>

      {/* Upload Modal */}
      <Modal
        opened={uploadModalOpened}
        onClose={closeUploadModal}
        title="Upload New List"
        size="lg"
        centered
      >
        <ListUpload />
      </Modal>
      </Container>
    </GalaxyBackground>
  );
}
