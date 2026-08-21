import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so a build can be opened from disk or served
  // from any sub-path, matching how this dashboard has always been used.
  base: './',
  server: { port: 5173, open: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js', 'src/**/*.test.jsx'],
  },
});
