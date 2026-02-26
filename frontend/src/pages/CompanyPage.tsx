/**
 * CompanyPage
 *
 * Route: /company/:domain
 * Loads company data and renders CompanyView with all sections.
 */

import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  LoadingOverlay,
  Alert,
  Group,
  Button,
  Text,
  Breadcrumbs,
  Anchor,
} from '@mantine/core';
import { IconAlertCircle, IconArrowLeft, IconHome } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import { getCompany } from '@/services/api';
import { CompanyView } from '@/components/company/CompanyView';

// =============================================================================
// Loading Component
// =============================================================================

function CompanyPageLoading() {
  return (
    <Container size="xl" py="md" pos="relative" mih={400}>
      <LoadingOverlay
        visible
        overlayProps={{
          radius: 'sm',
          blur: 2,
          bg: 'rgba(15, 23, 42, 0.8)',
        }}
        loaderProps={{
          color: 'blue',
          type: 'bars',
        }}
      />
    </Container>
  );
}

// =============================================================================
// Error Component
// =============================================================================

interface CompanyPageErrorProps {
  domain: string;
  error: Error;
  onRetry: () => void;
  onBack: () => void;
}

function CompanyPageError({ domain, error, onRetry, onBack }: CompanyPageErrorProps) {
  return (
    <Container size="md" py="xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Alert
          icon={<IconAlertCircle size={24} />}
          title="Failed to Load Company"
          color="red"
          variant="filled"
          radius="lg"
        >
          <Text size="sm" mb="md">
            We couldn't load data for <strong>{domain}</strong>.
          </Text>
          <Text size="sm" c="red.1" mb="lg">
            Error: {error.message}
          </Text>
          <Group gap="sm">
            <Button
              variant="white"
              color="red"
              size="sm"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
            >
              Go Back
            </Button>
            <Button
              variant="outline"
              color="white"
              size="sm"
              onClick={onRetry}
            >
              Try Again
            </Button>
          </Group>
        </Alert>
      </motion.div>
    </Container>
  );
}

// =============================================================================
// Not Found Component
// =============================================================================

interface CompanyNotFoundProps {
  domain: string;
  onBack: () => void;
  onAddCompany: () => void;
}

function CompanyNotFound({ domain, onBack, onAddCompany }: CompanyNotFoundProps) {
  return (
    <Container size="md" py="xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Alert
          icon={<IconAlertCircle size={24} />}
          title="Company Not Found"
          color="yellow"
          variant="light"
          radius="lg"
        >
          <Text size="sm" mb="md">
            <strong>{domain}</strong> is not in your target list yet.
          </Text>
          <Text size="sm" c="dimmed" mb="lg">
            Would you like to add this company to your list and start enrichment?
          </Text>
          <Group gap="sm">
            <Button
              variant="light"
              color="gray"
              size="sm"
              leftSection={<IconArrowLeft size={16} />}
              onClick={onBack}
            >
              Go Back
            </Button>
            <Button
              variant="filled"
              color="blue"
              size="sm"
              onClick={onAddCompany}
            >
              Add Company
            </Button>
          </Group>
        </Alert>
      </motion.div>
    </Container>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function CompanyPage() {
  const { domain } = useParams<{ domain: string }>();
  const navigate = useNavigate();

  // Validate domain parameter
  if (!domain) {
    return (
      <Container size="md" py="xl">
        <Alert
          icon={<IconAlertCircle size={24} />}
          title="Invalid URL"
          color="red"
          variant="light"
          radius="lg"
        >
          <Text size="sm" mb="md">
            No company domain specified in the URL.
          </Text>
          <Button
            variant="light"
            color="blue"
            size="sm"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/dashboard')}
          >
            Go to Dashboard
          </Button>
        </Alert>
      </Container>
    );
  }

  // Fetch company data to validate it exists
  const {
    data: company,
    isLoading,
    error,
    refetch,
    isError,
  } = useQuery({
    queryKey: ['company', domain],
    queryFn: () => getCompany(domain),
    retry: 1,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/dashboard');
    }
  };

  const handleAddCompany = () => {
    // TODO: Implement add company flow
    navigate(`/upload?domain=${domain}`);
  };

  // Breadcrumb items
  const breadcrumbItems = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Companies', href: '/companies' },
    { title: company?.company_name || domain, href: '#' },
  ];

  // Loading state
  if (isLoading) {
    return <CompanyPageLoading />;
  }

  // Error state
  if (isError && error) {
    // Check if it's a 404 error
    const is404 = error.message.includes('404') || error.message.includes('not found');

    if (is404) {
      return (
        <CompanyNotFound
          domain={domain}
          onBack={handleBack}
          onAddCompany={handleAddCompany}
        />
      );
    }

    return (
      <CompanyPageError
        domain={domain}
        error={error}
        onRetry={() => refetch()}
        onBack={handleBack}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Breadcrumbs */}
      <Container size="xl" py="sm">
        <Breadcrumbs
          separator="/"
          separatorMargin="sm"
          styles={{
            root: { fontSize: '0.875rem' },
            separator: { color: 'var(--mantine-color-dimmed)' },
          }}
        >
          <Anchor
            href="/dashboard"
            onClick={(e) => {
              e.preventDefault();
              navigate('/dashboard');
            }}
            c="dimmed"
            size="sm"
          >
            <Group gap={4}>
              <IconHome size={14} />
              Dashboard
            </Group>
          </Anchor>
          <Anchor
            href="/companies"
            onClick={(e) => {
              e.preventDefault();
              navigate('/companies');
            }}
            c="dimmed"
            size="sm"
          >
            Companies
          </Anchor>
          <Text size="sm" c="white">
            {company?.company_name || domain}
          </Text>
        </Breadcrumbs>
      </Container>

      {/* Company View */}
      <CompanyView />
    </motion.div>
  );
}

export default CompanyPage;
