/**
 * DataFeedback Component
 *
 * Allows users to report data corrections directly from the UI.
 * Submits to Supabase data_feedback table.
 *
 * Design principle: System is self-sufficient, relies on data sources + user verification.
 * No static exclusion lists - everything is database-driven.
 */

import { useState } from 'react';
import {
  Button,
  Modal,
  Select,
  Textarea,
  TextInput,
  Group,
  Stack,
  Text,
  Alert,
  Badge,
} from '@mantine/core';
import { IconFlag, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { supabase } from '@/services/supabase';

// Colors
const ALGOLIA_BLUE = '#003DFF';
const SUCCESS_GREEN = '#10b981';
const WARNING_AMBER = '#f59e0b';

interface DataFeedbackProps {
  domain: string;
  companyName?: string;
  currentData?: {
    isAlgoliaCustomer?: boolean;
    vertical?: string;
    [key: string]: unknown;
  };
  onFeedbackSubmitted?: () => void;
}

type FeedbackType =
  | 'is_algolia_customer'
  | 'not_algolia_customer'
  | 'incorrect_company_name'
  | 'incorrect_vertical'
  | 'duplicate_entry'
  | 'invalid_target'
  | 'data_correction'
  | 'positive_signal'
  | 'negative_signal';

const FEEDBACK_OPTIONS: { value: FeedbackType; label: string; description: string }[] = [
  {
    value: 'is_algolia_customer',
    label: 'This IS an Algolia customer',
    description: 'Mark this company as an existing Algolia customer (will remove from targets)',
  },
  {
    value: 'not_algolia_customer',
    label: 'This is NOT an Algolia customer',
    description: 'Confirm this company is not using Algolia',
  },
  {
    value: 'incorrect_company_name',
    label: 'Company name is wrong',
    description: 'The company name needs correction',
  },
  {
    value: 'incorrect_vertical',
    label: 'Wrong industry/vertical',
    description: 'The industry classification is incorrect',
  },
  {
    value: 'invalid_target',
    label: 'Invalid target',
    description: 'Company is defunct, acquired, or should not be a target',
  },
  {
    value: 'duplicate_entry',
    label: 'Duplicate entry',
    description: 'This is a duplicate of another record',
  },
  {
    value: 'data_correction',
    label: 'Other data correction',
    description: 'General data quality issue',
  },
];

export function DataFeedback({
  domain,
  companyName,
  currentData,
  onFeedbackSubmitted,
}: DataFeedbackProps) {
  const [opened, setOpened] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [correctedValue, setCorrectedValue] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!feedbackType) return;

    setSubmitting(true);
    setError(null);

    try {
      const { error: insertError } = await supabase.from('data_feedback').insert({
        domain,
        company_name: companyName,
        feedback_type: feedbackType,
        reported_value: correctedValue || null,
        original_value: currentData ? JSON.stringify(currentData) : null,
        evidence_url: evidenceUrl || null,
        notes: notes || null,
        confidence: 'medium',
        reported_by: 'ui_user', // Could be replaced with actual user auth
        source: 'ui',
      });

      if (insertError) throw insertError;

      setSubmitted(true);
      onFeedbackSubmitted?.();

      // Reset after delay
      setTimeout(() => {
        setOpened(false);
        setSubmitted(false);
        setFeedbackType(null);
        setCorrectedValue('');
        setEvidenceUrl('');
        setNotes('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedOption = FEEDBACK_OPTIONS.find((o) => o.value === feedbackType);

  return (
    <>
      <Button
        variant="subtle"
        size="xs"
        leftSection={<IconFlag size={14} />}
        onClick={() => setOpened(true)}
        style={{ color: WARNING_AMBER }}
      >
        Report Issue
      </Button>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        title={
          <Group gap="xs">
            <IconFlag size={20} color={ALGOLIA_BLUE} />
            <Text fw={600}>Report Data Issue</Text>
          </Group>
        }
        size="md"
      >
        {submitted ? (
          <Alert
            icon={<IconCheck size={16} />}
            color="green"
            title="Feedback Submitted"
          >
            Thank you! Your feedback has been recorded and will be reviewed.
          </Alert>
        ) : (
          <Stack gap="md">
            <div>
              <Text size="sm" c="dimmed">
                Reporting issue for:
              </Text>
              <Text fw={600}>{companyName || domain}</Text>
              <Badge size="xs" color="gray">
                {domain}
              </Badge>
            </div>

            <Select
              label="What's the issue?"
              placeholder="Select feedback type"
              data={FEEDBACK_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
              value={feedbackType}
              onChange={(v) => setFeedbackType(v as FeedbackType)}
              required
            />

            {selectedOption && (
              <Text size="xs" c="dimmed">
                {selectedOption.description}
              </Text>
            )}

            {feedbackType &&
              ['is_algolia_customer', 'incorrect_company_name', 'incorrect_vertical'].includes(
                feedbackType
              ) && (
                <TextInput
                  label={
                    feedbackType === 'incorrect_company_name'
                      ? 'Correct company name'
                      : feedbackType === 'incorrect_vertical'
                        ? 'Correct industry/vertical'
                        : 'Confirmation'
                  }
                  placeholder={
                    feedbackType === 'is_algolia_customer' ? 'Yes, they are a customer' : ''
                  }
                  value={correctedValue}
                  onChange={(e) => setCorrectedValue(e.target.value)}
                />
              )}

            <TextInput
              label="Evidence URL (optional)"
              placeholder="https://..."
              description="Link to case study, BuiltWith, or other proof"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
            />

            <Textarea
              label="Additional notes (optional)"
              placeholder="Any context that helps verify this..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {error}
              </Alert>
            )}

            <Group justify="flex-end" mt="md">
              <Button variant="subtle" onClick={() => setOpened(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                loading={submitting}
                disabled={!feedbackType}
                style={{ background: ALGOLIA_BLUE }}
              >
                Submit Feedback
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );
}

export default DataFeedback;
