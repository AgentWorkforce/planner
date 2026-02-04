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
    port: 5174,
    proxy: {
      // Forge API (Orchestrator backend)
      '/forge-api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws/forge': {
        target: 'ws://localhost:3001',
        ws: true,
      },
      // Planner API (for plan data)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
