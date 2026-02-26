/**
 * PartnerForge - Partner Intelligence Platform
 *
 * Main application entry point with routing, providers, and theme configuration.
 */

import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Contexts
import { PartnerProvider } from './contexts/PartnerContext';

// Layout
import { AppShell } from './components/layout/AppShell';

// Pages
import { Dashboard } from './pages/Dashboard';
import { TargetDetail } from './pages/TargetDetail';
import { DashboardPage } from './pages/DashboardPage';
import { ListsPage } from './pages/ListsPage';
import { UploadPage } from './pages/UploadPage';
import { CompanyPage } from './pages/CompanyPage';
import { AlertsPage } from './pages/AlertsPage';
import { CompaniesPage } from './pages/CompaniesPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DocsPage } from './pages/DocsPage';

// Styles
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/dropzone/styles.css';
import './styles/global.css';

// =============================================================================
// Mantine Theme Configuration
// =============================================================================

const theme = createTheme({
  primaryColor: 'blue',
  colors: {
    // Custom Algolia brand colors
    algolia: [
      '#e6ebff',
      '#b3c2ff',
      '#8099ff',
      '#4d70ff',
      '#1a47ff',
      '#003dff', // Primary - Nebula Blue
      '#0031cc',
      '#002599',
      '#001966',
      '#000d33',
    ],
    // Signal status colors
    hot: [
      '#fee2e2', '#fecaca', '#fca5a5', '#f87171',
      '#ef4444', '#dc2626', '#b91c1c', '#991b1b',
      '#7f1d1d', '#450a0a',
    ],
    warm: [
      '#ffedd5', '#fed7aa', '#fdba74', '#fb923c',
      '#f97316', '#ea580c', '#c2410c', '#9a3412',
      '#7c2d12', '#431407',
    ],
  },
  fontFamily: 'Source Sans Pro, ui-sans-serif, system-ui, sans-serif',
  headings: {
    fontFamily: 'Source Sans Pro, ui-sans-serif, system-ui, sans-serif',
  },
  defaultRadius: 'md',
  components: {
    Paper: {
      defaultProps: {
        shadow: 'sm',
      },
    },
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});

// =============================================================================
// React Query Configuration
// =============================================================================

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

// =============================================================================
// App Component
// =============================================================================

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <PartnerProvider>
          <Notifications position="top-right" limit={5} />
          <BrowserRouter>
            <Routes>
            {/* Main Layout with Sidebar */}
            <Route element={<AppShell />}>
              {/* Redirect root to dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Dashboard - Use new premium Dashboard */}
              <Route path="/dashboard" element={<Dashboard />} />

              {/* Companies - List view with advanced filtering */}
              <Route path="/companies" element={<CompaniesPage />} />
              <Route path="/company/:domain" element={<TargetDetail />} />

              {/* Lists */}
              <Route path="/lists" element={<ListsPage />} />

              {/* Upload */}
              <Route path="/upload" element={<UploadPage />} />

              {/* Analytics - Traffic & Performance */}
              <Route path="/analytics" element={<AnalyticsPage />} />

              {/* Alerts */}
              <Route path="/alerts" element={<AlertsPage />} />

              {/* Documentation */}
              <Route path="/docs" element={<DocsPage />} />

              {/* Settings (placeholder) */}
              <Route
                path="/settings"
                element={
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--mantine-color-dimmed)' }}>
                    Settings coming soon...
                  </div>
                }
              />
            </Route>

            {/* 404 Fallback */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </PartnerProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default App;
