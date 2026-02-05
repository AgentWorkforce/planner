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
        // SSE requires these settings to prevent buffering
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            // Disable buffering for SSE endpoints
            if (req.url?.includes('/events')) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        },
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
        // SSE requires these settings to prevent buffering
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            // Disable buffering for SSE endpoints
            if (req.url?.includes('/events')) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        },
      },
    },
  },
});
