import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const serverUrl = env.VITE_SERVER_URL || 'http://localhost:5274';

  return {
    plugins: [react()],
    server: {
      port: Number(env.VITE_PORT) || 5273,
      // Fail instead of silently moving to another port, so a clash is obvious.
      strictPort: true,
      // In development the frontend talks to /api and Vite forwards to Express,
      // so no cross-origin configuration is needed locally.
      proxy: {
        '/api': { target: serverUrl, changeOrigin: true },
      },
    },
    build: {
      target: 'es2020',
      sourcemap: mode !== 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
