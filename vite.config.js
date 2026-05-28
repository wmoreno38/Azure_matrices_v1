import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://l-inea1-5v3.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
