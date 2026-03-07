/**
 * Enrichment Status Component
 *
 * Displays real-time enrichment progress with 4 waves and 15 modules.
 * Listens to WebSocket events for live updates.
 *
 * Props:
 * - auditId: string - The audit ID to monitor
 *
 * WebSocket Events:
 * - enrichment:progress - Module progress updates
 * - enrichment:completed - Enrichment completed
 * - enrichment:failed - Enrichment failed
 */

import React, { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

interface ModuleStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  percent: number;
  insight?: string;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

interface EnrichmentProgress {
  wave: number;
  module: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  percent: number;
  insight?: string;
  error?: string;
}

interface EnrichmentStatusProps {
  auditId: string;
}

const MODULES = {
  1: ['M01: Company Context', 'M02: Technology Stack', 'M03: Traffic Analysis', 'M05: Competitor Intelligence'],
  2: ['M04: Financial Profile', 'M06: Hiring Signals', 'M07: Strategic Context'],
  3: ['M08: Investor Intelligence', 'M09: Executive Intelligence', 'M10: Buying Committee'],
  4: ['M11: Displacement Analysis', 'M12: Case Study Matching', 'M13: ICP Priority Mapping', 'M14: Signal Scoring', 'M15: Strategic Brief'],
};

export const EnrichmentStatus: React.FC<EnrichmentStatusProps> = ({ auditId }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [modules, setModules] = useState<Map<string, ModuleStatus>>(new Map());
  const [overallStatus, setOverallStatus] = useState<'pending' | 'running' | 'completed' | 'failed'>('pending');

  // Initialize WebSocket connection
  useEffect(() => {
    const wsUrl = process.env.REACT_APP_WS_URL || 'http://localhost:3001';
    const newSocket = io(wsUrl, {
      path: '/ws',
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      newSocket.emit('subscribe:audit', auditId);
    });

    newSocket.on('subscribed', () => {
      console.log('Subscribed to audit:', auditId);
    });

    // Listen for enrichment progress
    newSocket.on('enrichment:progress', (data: EnrichmentProgress) => {
      console.log('Enrichment progress:', data);
      setModules((prev) => {
        const updated = new Map(prev);
        updated.set(data.module, {
          status: data.status,
          percent: data.percent,
          insight: data.insight,
          error: data.error,
          startedAt: data.status === 'running' ? new Date() : prev.get(data.module)?.startedAt,
          completedAt: data.status === 'completed' || data.status === 'failed' ? new Date() : undefined,
        });
        return updated;
      });

      if (data.status === 'running') {
        setOverallStatus('running');
      }
    });

    // Listen for enrichment completion
    newSocket.on('enrichment:completed', () => {
      console.log('Enrichment completed');
      setOverallStatus('completed');
    });

    // Listen for enrichment failure
    newSocket.on('enrichment:failed', (data: { error: string }) => {
      console.error('Enrichment failed:', data.error);
      setOverallStatus('failed');
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    setSocket(newSocket);

    return () => {
      newSocket.emit('unsubscribe:audit', auditId);
      newSocket.close();
    };
  }, [auditId]);

  // Initialize all modules as pending
  useEffect(() => {
    const initialModules = new Map<string, ModuleStatus>();
    Object.values(MODULES).flat().forEach((module) => {
      initialModules.set(module, {
        status: 'pending',
        percent: 0,
      });
    });
    setModules(initialModules);
  }, []);

  // Calculate overall progress
  const overallProgress = React.useMemo(() => {
    const totalModules = Object.values(MODULES).flat().length;
    let completedCount = 0;
    modules.forEach((status) => {
      if (status.status === 'completed') completedCount++;
    });
    return Math.round((completedCount / totalModules) * 100);
  }, [modules]);

  // Render module card
  const renderModuleCard = (moduleName: string) => {
    const status = modules.get(moduleName) || { status: 'pending', percent: 0 };
    const statusColors = {
      pending: 'bg-gray-100 text-gray-600',
      running: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };

    return (
      <div
        key={moduleName}
        className={`p-4 rounded-lg border-2 ${
          status.status === 'running' ? 'border-blue-400' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-semibold text-sm">{moduleName}</h4>
          <span
            className={`px-2 py-1 rounded text-xs font-medium ${statusColors[status.status]}`}
          >
            {status.status.toUpperCase()}
          </span>
        </div>

        {status.status === 'running' && (
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${status.percent}%` }}
            />
          </div>
        )}

        {status.insight && (
          <p className="text-xs text-gray-600 mt-2 line-clamp-2">{status.insight}</p>
        )}

        {status.error && (
          <p className="text-xs text-red-600 mt-2 line-clamp-2">{status.error}</p>
        )}
      </div>
    );
  };

  // Render wave section
  const renderWave = (waveNumber: number, waveModules: string[]) => {
    const waveStatus = waveModules.every((m) => modules.get(m)?.status === 'completed')
      ? 'completed'
      : waveModules.some((m) => modules.get(m)?.status === 'running')
      ? 'running'
      : waveModules.some((m) => modules.get(m)?.status === 'failed')
      ? 'failed'
      : 'pending';

    const waveColors = {
      pending: 'bg-gray-100 text-gray-600',
      running: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };

    return (
      <div key={waveNumber} className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold">Wave {waveNumber}</h3>
          <span
            className={`px-3 py-1 rounded text-sm font-medium ${waveColors[waveStatus]}`}
          >
            {waveStatus.toUpperCase()}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {waveModules.map(renderModuleCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Enrichment Progress</h2>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  overallStatus === 'completed'
                    ? 'bg-green-500'
                    : overallStatus === 'failed'
                    ? 'bg-red-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-semibold">{overallProgress}%</span>
        </div>
      </div>

      {/* Status Banner */}
      {overallStatus === 'completed' && (
        <div className="mb-6 p-4 bg-green-50 border-2 border-green-200 rounded-lg">
          <p className="text-green-800 font-semibold">
            ✓ Enrichment completed successfully! All 15 modules executed.
          </p>
        </div>
      )}

      {overallStatus === 'failed' && (
        <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <p className="text-red-800 font-semibold">
            ✗ Enrichment failed. Check module errors below.
          </p>
        </div>
      )}

      {/* Waves */}
      {Object.entries(MODULES).map(([waveNum, waveModules]) =>
        renderWave(parseInt(waveNum), waveModules)
      )}
    </div>
  );
};
