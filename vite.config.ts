import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [vue(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      target: 'es2022',
    },
    server: {
      port: 3000,
      proxy: env.VITE_BACKEND_URL
        ? {
            '/api': {
              target: env.VITE_BACKEND_URL,
              changeOrigin: true,
            },
            '/upload': {
              target: env.VITE_BACKEND_URL,
              changeOrigin: true,
            },
            '/file': {
              target: env.VITE_BACKEND_URL,
              changeOrigin: true,
            },
          }
        : undefined,
    },
  }
})
