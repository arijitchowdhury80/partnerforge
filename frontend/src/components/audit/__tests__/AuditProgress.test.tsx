/**
 * AuditProgress Component Tests
 *
 * Tests for the AuditProgress component with WebSocket mocking
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { AuditProgress } from '../AuditProgress';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
  id: 'mock-socket-id',
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => mockSocket),
}));

describe('AuditProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <MantineProvider>
        <AuditProgress auditId="audit-123" {...props} />
      </MantineProvider>
    );
  };

  it('should render with initial state', () => {
    renderComponent();

    expect(screen.getByText('Audit Progress')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('should connect to WebSocket on mount', () => {
    renderComponent();

    expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('subscribed', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('audit:event', expect.any(Function));
  });

  it('should subscribe to audit on connection', async () => {
    renderComponent();

    // Simulate connection
    const connectHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'connect'
    )?.[1];

    if (connectHandler) {
      connectHandler();
    }

    await waitFor(() => {
      expect(mockSocket.emit).toHaveBeenCalledWith('subscribe:audit', 'audit-123');
    });
  });

  it('should display phase cards', () => {
    renderComponent();

    expect(screen.getByText('Collecting company data')).toBeInTheDocument();
    expect(screen.getByText('Running search tests')).toBeInTheDocument();
    expect(screen.getByText('Analyzing opportunities')).toBeInTheDocument();
    expect(screen.getByText('Generating reports')).toBeInTheDocument();
  });

  it('should update progress on audit events', async () => {
    renderComponent();

    // Get the audit:event handler
    const eventHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'audit:event'
    )?.[1];

    // Simulate progress event
    if (eventHandler) {
      eventHandler({
        type: 'test:started',
        data: {
          progress: {
            percentage: 50,
            message: 'Halfway there',
          },
        },
      });
    }

    await waitFor(() => {
      expect(screen.getByText('50%')).toBeInTheDocument();
      expect(screen.getByText('Halfway there')).toBeInTheDocument();
    });
  });

  it('should show completion state', async () => {
    renderComponent();

    // Get the audit:event handler
    const eventHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'audit:event'
    )?.[1];

    // Simulate completion event
    if (eventHandler) {
      eventHandler({
        type: 'audit:completed',
        data: {},
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Audit Complete!')).toBeInTheDocument();
      expect(screen.getByText('All phases completed successfully')).toBeInTheDocument();
      expect(screen.getByText('View Results')).toBeInTheDocument();
    });
  });

  it('should show error state', async () => {
    renderComponent();

    // Get the audit:event handler
    const eventHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'audit:event'
    )?.[1];

    // Simulate error event
    if (eventHandler) {
      eventHandler({
        type: 'audit:error',
        data: {
          error: 'Something went wrong',
        },
      });
    }

    await waitFor(() => {
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('should call onComplete callback when audit completes', async () => {
    const onComplete = vi.fn();
    renderComponent({ onComplete });

    // Get the audit:event handler
    const eventHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'audit:event'
    )?.[1];

    // Simulate completion event
    if (eventHandler) {
      eventHandler({
        type: 'audit:completed',
        data: {},
      });
    }

    await waitFor(() => {
      expect(onComplete).toHaveBeenCalled();
    });
  });

  it('should disconnect WebSocket on unmount', () => {
    const { unmount } = renderComponent();

    unmount();

    expect(mockSocket.emit).toHaveBeenCalledWith('unsubscribe:audit', 'audit-123');
    expect(mockSocket.disconnect).toHaveBeenCalled();
  });

  it('should show connection status', async () => {
    renderComponent();

    // Initially should show connecting
    expect(screen.getByText('Connecting to real-time updates...')).toBeInTheDocument();

    // Simulate connection
    const connectHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'connect'
    )?.[1];

    if (connectHandler) {
      connectHandler();
    }

    await waitFor(() => {
      expect(screen.queryByText('Connecting to real-time updates...')).not.toBeInTheDocument();
    });
  });

  it('should update phase statuses based on progress', async () => {
    renderComponent();

    // Get the audit:event handler
    const eventHandler = mockSocket.on.mock.calls.find(
      (call) => call[0] === 'audit:event'
    )?.[1];

    // Simulate progress to 50% (search-audit phase)
    if (eventHandler) {
      eventHandler({
        type: 'test:started',
        data: {
          progress: {
            percentage: 50,
            message: 'Running tests',
          },
        },
      });
    }

    await waitFor(() => {
      // First phase should be completed (progress >= 25%)
      const badges = screen.getAllByText('Completed');
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
