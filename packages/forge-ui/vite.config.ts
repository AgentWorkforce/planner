import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3003,
    proxy: {
      // Forge API routes (mounted at /api/forge in backend)
      '/api/forge': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // WebSocket for forge real-time updates
      '/ws/forge': {
        target: 'ws://localhost:3001',
        ws: true,
      },
      // Planner/Ideation API (same backend)
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
