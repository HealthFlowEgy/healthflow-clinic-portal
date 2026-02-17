import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      // NDP Platform API Gateway proxy (development only)
      '/fhir': {
        target: 'https://ndp-gateway.healthflow.tech',
        changeOrigin: true,
        secure: true,
      },
      '/api/v1': {
        target: 'https://ndp-gateway.healthflow.tech',
        changeOrigin: true,
        secure: true,
      },
      '/api/prescriptions': {
        target: 'https://ndp-gateway.healthflow.tech',
        changeOrigin: true,
        secure: true,
      },
      '/api/medications': {
        target: 'https://ndp-gateway.healthflow.tech',
        changeOrigin: true,
        secure: true,
      },
      '/api/dispense': {
        target: 'https://ndp-gateway.healthflow.tech',
        changeOrigin: true,
        secure: true,
      },
      '/api/recalls': {
        target: 'https://ndp-gateway.healthflow.tech',
        changeOrigin: true,
        secure: true,
      },
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'mui-vendor': ['@mui/material', '@mui/icons-material'],
          'keycloak': ['keycloak-js'],
        }
      }
    }
  }
})
