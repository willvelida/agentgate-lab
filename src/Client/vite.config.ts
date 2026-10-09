import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    emptyOutDir: true,
    outDir: '../Portal/wwwroot',
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/testSetup.ts',
  },
})
