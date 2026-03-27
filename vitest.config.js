import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
export default defineConfig({
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer')
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    environmentMatchGlobs: [
      ['tests/main/**', 'node'],
    ],
  },
})
