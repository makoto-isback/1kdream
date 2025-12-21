import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Alias buffer package for browser compatibility
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    // Include buffer in optimization for @ton/core compatibility
    include: ['buffer'],
  },
  server: {
    host: true,
    allowedHosts: 'all'
  },
  preview: {
    host: true,
    allowedHosts: 'all'
  },
});

