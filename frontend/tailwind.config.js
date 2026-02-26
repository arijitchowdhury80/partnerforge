/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Tremor components
    './node_modules/@tremor/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Algolia brand colors
        'algolia-blue': '#003DFF',
        'algolia-purple': '#5468FF',
        'algolia-gray': '#21243D',
        // Signal status colors
        hot: '#ef4444',
        warm: '#f97316',
        cool: '#3b82f6',
        cold: '#6b7280',
        // Margin zone colors
        'margin-green': '#22c55e',
        'margin-yellow': '#eab308',
        'margin-red': '#ef4444',
        // Source freshness colors
        fresh: '#22c55e',
        stale: '#eab308',
        expired: '#ef4444',
      },
      fontFamily: {
        sans: [
          'Source Sans Pro',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
