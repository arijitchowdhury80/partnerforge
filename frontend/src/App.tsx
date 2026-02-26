import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AppShell } from './components/common/AppShell';
import { Dashboard } from './components/dashboard/Dashboard';
import { CompanyView } from './components/company/CompanyView';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dates/styles.css';
import './styles/global.css';

// Mantine theme configuration
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
      '#003dff', // Primary
      '#0031cc',
      '#002599',
      '#001966',
      '#000d33',
    ],
  },
  fontFamily: 'Source Sans Pro, ui-sans-serif, system-ui, sans-serif',
  headings: {
    fontFamily: 'Source Sans Pro, ui-sans-serif, system-ui, sans-serif',
  },
  defaultRadius: 'md',
});

// React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <Notifications position="top-right" />
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/company/:domain" element={<CompanyView />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
}

export default App;
